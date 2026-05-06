# Phase 3B Quick Start - Database Migration

**Time to Deploy**: 5-10 minutes  
**Complexity**: Low (SQL execution only)  
**Dependencies**: PostgreSQL 12+ running, Docker setup working  

---

## ⚡ TL;DR - Run These Commands

```bash
# 1. Copy migration files to Docker container
docker cp migrations/0032_phase3_monitoring_metrics_phase1.sql docker-postgres-1:/tmp/
docker cp migrations/0033_phase3_monitoring_metrics_phase2.sql docker-postgres-1:/tmp/
docker cp migrations/0034_phase3_monitoring_metrics_phase3.sql docker-postgres-1:/tmp/

# 2. Run migrations in order (one at a time)
docker exec docker-postgres-1 psql -U growth_halo -d mtaadao -f /tmp/0032_phase3_monitoring_metrics_phase1.sql
docker exec docker-postgres-1 psql -U growth_halo -d mtaadao -f /tmp/0033_phase3_monitoring_metrics_phase2.sql
docker exec docker-postgres-1 psql -U growth_halo -d mtaadao -f /tmp/0034_phase3_monitoring_metrics_phase3.sql

# 3. Verify all tables created
docker exec docker-postgres-1 psql -U growth_halo -d mtaadao -c "\dt public.*metrics"
```

---

## 📊 What Gets Created

| Phase | Tables | Purpose |
|---|---|---|
| Phase 1 | 8 tables | Platform monitoring & metrics |
| Phase 2 | 4 tables | Growth, API usage, support |
| Phase 3 | 4 tables | Referrals, leaderboard, rewards, DAO analytics |
| **Total** | **16 tables** | **All admin endpoints now have real data** |

---

## 🎯 After Migration

```typescript
// Your 38 endpoints now automatically use real data
const data = await MetricsCacheService.getOrSet(
  CACHE_KEY,
  async () => {
    // This now queries the NEW tables!
    return db.select(...).from(platform_metrics);
  },
  CACHE_TTL.SHORT
);
```

---

## ✅ Verification (Takes 30 seconds)

```bash
# Quick check - should show 16 tables
docker exec docker-postgres-1 psql -U growth_halo -d mtaadao -c "\dt public.*metrics" | wc -l

# Detailed check - shows table sizes
docker exec docker-postgres-1 psql -U growth_halo -d mtaadao -c "
SELECT tablename 
FROM pg_tables 
WHERE schemaname='public' AND tablename LIKE '%metrics%'
ORDER BY tablename;"
```

---

## ⚠️ Before You Start

- [ ] Docker container is running: `docker ps | grep postgres`
- [ ] You have DATABASE_URL set in `.env`
- [ ] Backup existing database (optional but recommended)
- [ ] No other migrations running

---

## 🔄 If Something Goes Wrong

```bash
# Check Docker logs
docker logs docker-postgres-1 | tail -50

# Test connection
docker exec docker-postgres-1 psql -U growth_halo -d mtaadao -c "SELECT 1"

# Rollback tables (careful!)
docker exec docker-postgres-1 psql -U growth_halo -d mtaadao -c "
DROP TABLE IF EXISTS dao_analytics, reward_distribution, leaderboard_rankings, 
  referral_metrics, tokenomics_metrics, support_ticket_metrics,
  platform_growth_metrics, api_usage_metrics, agent_performance_metrics,
  payment_provider_metrics, revenue_metrics, liquidity_pool_metrics,
  blockchain_health_metrics, cefi_exchange_metrics, defi_protocol_metrics,
  platform_metrics CASCADE;"
```

---

## 📁 Migration Files Location

```
migrations/
  ├─ 0032_phase3_monitoring_metrics_phase1.sql  (8 tables)
  ├─ 0033_phase3_monitoring_metrics_phase2.sql  (4 tables)
  └─ 0034_phase3_monitoring_metrics_phase3.sql  (4 tables)
```

---

## 🎉 Success = You're Done!

When you see:
```
CREATE TABLE
CREATE INDEX
CREATE TABLE
...
(16 times total)
```

Your Phase 3B is complete! All 38 endpoints now have real database backing.

---

**See Also**: [PHASE_3B_DATABASE_MIGRATION_GUIDE.md](PHASE_3B_DATABASE_MIGRATION_GUIDE.md) for detailed instructions

