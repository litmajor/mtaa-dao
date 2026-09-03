# Instrumentation Plan for Pricing §6 Tuning

**Purpose**: Collect minimal evidence to replace guesses in pricing.md §6 TBDs once real users exist.

**Status**: Plan only — not yet implemented. Ready for first production window.

---

## TBDs That Require Real Data

1. **Vault-count caps per normal vault type** — numeric values not yet decided (pricing.md §6.1)
   - *Why needed*: To set soft-cap tiers without guessing based on zero real usage
   - *Data to collect*: Vault creation frequency per user, vault dormancy patterns, vault type distribution

2. **Volume ladder bracket thresholds and fee percentages** — needs real usage data (pricing.md §6.4)
   - *Why needed*: Current flat 2.0% is a placeholder; real ladder requires volume distribution
   - *Data to collect*: Transaction volume per user, per DAO, distribution shape

3. **MTAA discount lock duration and discount percentage** — needs real usage data (pricing.md §6.5)
   - *Why needed*: Lock-in behavior affects retention and conversion; need real engagement data first
   - *Data to collect*: MTAA holding duration, MTAA to transaction conversion rate

4. **One-time DAO creation fee amount(s), possibly scaled by member count** — not yet specified (pricing.md §6.6)
   - *Why needed*: Needs real cost-per-DAO to justify; also needs to validate member-count scaling
   - *Data to collect*: DAO member growth patterns, DAO survival/churn, cost-per-DAO operation

---

## Minimal Instrumentation: What to Track

### A. Transaction Volume (Required for fee ladder tuning)

**Table**: `transaction_volume_tracking` (create if not exists)

```sql
CREATE TABLE IF NOT EXISTS transaction_volume_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id),
  dao_id UUID REFERENCES daos(id),
  transaction_type VARCHAR, -- 'on_ramp', 'off_ramp', 'swap', 'pool_investment', 'withdrawal'
  amount_usd DECIMAL(18, 2),
  fee_percent DECIMAL(5, 2), -- the fee % that was charged
  timestamp TIMESTAMP DEFAULT NOW(),
  period_date DATE DEFAULT CURRENT_DATE,
  -- For daily aggregation queries
  INDEX (period_date, transaction_type),
  INDEX (user_id, period_date),
  INDEX (dao_id, period_date)
);

-- Aggregation view (90-day rolling average)
CREATE OR REPLACE VIEW user_transaction_volume_90d AS
  SELECT 
    user_id,
    SUM(amount_usd) as total_volume_usd,
    COUNT(*) as transaction_count,
    AVG(amount_usd) as avg_transaction_usd,
    STDDEV(amount_usd) as stddev_transaction_usd,
    DATE_TRUNC('day', MAX(timestamp)) as last_transaction_date
  FROM transaction_volume_tracking
  WHERE timestamp >= NOW() - INTERVAL '90 days'
  GROUP BY user_id;
```

**What to log**: Every transaction that passes through `calculateTransactionFee()` in `revenueService.ts`.

**Why this matters**: Determines volume-based fee bracket thresholds. Example decision point: "Users >$10K/month qualify for bracket B", etc.

---

### B. Vault Lifecycle Tracking (Required for vault-cap tuning)

**Table**: `vault_lifecycle_tracking` (create if not exists)

```sql
CREATE TABLE IF NOT EXISTS vault_lifecycle_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id),
  vault_id UUID REFERENCES vaults(id),
  vault_type VARCHAR, -- 'regular', 'savings', 'locked_savings', 'yield', 'dao_treasury'
  action VARCHAR, -- 'created', 'dormant', 'active', 'closed', 'migrated'
  timestamp TIMESTAMP DEFAULT NOW(),
  metadata JSONB, -- {previous_status, deposit_count, last_deposit_date, tvl_at_action, etc}
  -- For retention analysis
  INDEX (user_id, vault_type),
  INDEX (action, timestamp),
  INDEX (vault_type, timestamp)
);

-- Retention view: % of vaults still active 30/90/180 days after creation
CREATE OR REPLACE VIEW vault_retention_cohort AS
  SELECT 
    vault_type,
    DATE_TRUNC('week', created_at) as cohort_week,
    COUNT(*) as created_count,
    SUM(CASE WHEN action = 'active' AND timestamp >= created_at + INTERVAL '30 days' THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as retention_30d,
    SUM(CASE WHEN action = 'active' AND timestamp >= created_at + INTERVAL '90 days' THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as retention_90d,
    SUM(CASE WHEN action = 'closed' THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as churn_rate
  FROM vault_lifecycle_tracking
  WHERE action IN ('created', 'active', 'closed')
  GROUP BY vault_type, DATE_TRUNC('week', created_at);
```

**What to log**: 
- Every `POST /api/vaults` creates a `created` event
- DAO/cron jobs mark vaults as `dormant` if no activity for 30 days
- Vault closure or migration generates `closed`/`migrated` events

**Why this matters**: Determines soft-cap tiers per vault type. Example decision point: "Regular vaults: cap at 10, but users with 30+ day retention can request cap raise to 15", etc.

---

### C. DAO Growth & Churn (Required for creation fee sizing)

**Table**: `dao_cohort_tracking` (create if not exists)

```sql
CREATE TABLE IF NOT EXISTS dao_cohort_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id UUID REFERENCES daos(id),
  cohort_date DATE, -- When DAO was created
  action VARCHAR, -- 'created', 'milestone_5_members', 'milestone_10_members', 'milestone_50_members', 'churned'
  member_count INT,
  treasury_balance_usd DECIMAL(18, 2),
  active_vaults INT,
  last_transaction_date TIMESTAMP,
  timestamp TIMESTAMP DEFAULT NOW(),
  INDEX (cohort_date, action),
  INDEX (dao_id)
);

-- Survival curve view
CREATE OR REPLACE VIEW dao_survival_curve AS
  SELECT 
    DATE_TRUNC('week', cohort_date) as cohort_week,
    COUNT(DISTINCT dao_id) as created_count,
    SUM(CASE WHEN action = 'churned' THEN 1 ELSE 0 END)::FLOAT / COUNT(*) as churn_rate_by_week,
    AVG(member_count) as avg_member_count_at_action,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY member_count) as median_member_count
  FROM dao_cohort_tracking
  GROUP BY DATE_TRUNC('week', cohort_date);
```

**What to log**:
- Every DAO creation: `created` event with initial member count (usually 1)
- Member milestones (5, 10, 50 members): automatic events
- Churn: DAO with 0 members for 60+ days, or DAO explicitly archived

**Why this matters**: 
- Justifies creation fee amount and whether member-count scaling is viable
- Example decision: "DAO creation fee $5; if DAO survives 90 days with 5+ members, retrospective fee waived", etc.

---

### D. MTAA Engagement (Required for discount lock tuning)

**Table**: `mtaa_engagement_tracking` (create if not exists)

```sql
CREATE TABLE IF NOT EXISTS mtaa_engagement_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id),
  action VARCHAR, -- 'locked_for_discount', 'discount_used', 'lock_expired', 'early_unlock'
  mtaa_amount DECIMAL(18, 8),
  lock_duration_days INT, -- requested lock duration
  discount_percent DECIMAL(5, 2),
  timestamp TIMESTAMP DEFAULT NOW(),
  lock_expires_at TIMESTAMP,
  INDEX (user_id, action),
  INDEX (lock_expires_at)
);

-- Engagement conversion view
CREATE OR REPLACE VIEW mtaa_discount_conversion AS
  SELECT 
    CASE 
      WHEN lock_duration_days <= 30 THEN '30d'
      WHEN lock_duration_days <= 90 THEN '90d'
      WHEN lock_duration_days <= 180 THEN '180d'
      ELSE '180d+'
    END as lock_bucket,
    COUNT(DISTINCT CASE WHEN action = 'locked_for_discount' THEN user_id END) as locked_users,
    COUNT(DISTINCT CASE WHEN action = 'discount_used' THEN user_id END) as discount_users,
    COUNT(DISTINCT CASE WHEN action = 'discount_used' THEN user_id END)::FLOAT / 
      NULLIF(COUNT(DISTINCT CASE WHEN action = 'locked_for_discount' THEN user_id END), 0) as conversion_rate,
    AVG(discount_percent) as avg_discount_applied
  FROM mtaa_engagement_tracking
  GROUP BY lock_bucket;
```

**What to log**:
- User initiates MTAA lock for discount: `locked_for_discount` event
- User applies discount in a transaction: `discount_used` event
- Lock expires without use: `lock_expired` event
- User exits lock early: `early_unlock` event

**Why this matters**: Determines lock duration and discount percentage that maximizes conversion without hurting revenue. Example decision point: "90-day lock at 5% discount achieves 40% conversion; increase to 7.5% to hit 60%", etc.

---

## Collection Strategy

### Phase 1: Add event logging (Week 1–2)
1. Add `logTransactionVolume()` calls in `revenueService.ts` after every fee calculation
2. Add `logVaultLifecycle()` calls in `vaultService.ts` on create, dormancy check, close
3. Add `logDaoMilestone()` calls in `daoService.ts` on member count milestones
4. Add `logMtaaEngagement()` calls in MTAA discount flow

### Phase 2: Create aggregation views (Week 2)
- Deploy the SQL views above
- No backfill needed; data collection starts from deployment date

### Phase 3: Dashboard/monitoring (Week 3–4)
- Simple Grafana dashboard: transaction volume distribution (histogram), vault retention curves, DAO cohort survival
- Monthly report: "X% of users are in volume bracket B; Y% of vaults are dormant by 90 days; Z% of locked MTAA converts to discount usage"
- No need for sophisticated ML; just percentiles and survival curves

### Phase 4: Decision-making (Once 1–2 months of data exists)
- **Fee ladder**: Use volume histogram to set bracket cutoffs (e.g., 20th/40th/60th/80th percentiles)
- **Vault caps**: Use retention curves to determine tier breakpoints (e.g., "users with 90-day active rate >80% earn +5 vault slots")
- **MTAA discount**: Use conversion data to optimize lock duration and discount % for target engagement
- **DAO creation fee**: Use survival curves to size fee (e.g., "DAOs with 30+ days survive at 70% rate; set fee to match value", etc.)

---

## Success Criteria

✅ **Launch-ready** when:
1. All event logging is wired in and logs are flowing to the tracking tables
2. Aggregation views return sensible data (no NULLs, counts match transaction/vault/DAO counts)
3. Dashboard confirms 4+ weeks of clean data collected
4. Team can answer: "What was the median transaction volume across users last month?" and "What's the 90-day vault retention rate?" from dashboard

❌ **Do NOT launch TBD tuning** if:
- Tracking tables are empty or corrupted
- Aggregation views have >10% NULL results
- Data collection period is <2 weeks

---

## Notes

- This plan is **independent** of the flat 2.0% placeholder fee. Logging will capture what users **actually** pay, so the real ladder can be derived from the data.
- All tracking tables use indexes on common query patterns (cohort dates, user/DAO IDs, action types) to keep writes fast.
- No sensitive data (PII) is logged; only aggregate amounts, types, and timestamps.
- Once tuning is done (e.g., vault caps finalized), these tables can be archived or summarized; they don't need to stay hot forever.
