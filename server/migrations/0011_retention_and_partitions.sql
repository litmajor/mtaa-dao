-- ============================================================================
-- MIGRATION 0011: Retention infrastructure + indexes for high-growth tables
--
-- Two things this migration does:
--   A) Add timestamp indexes on every table the retention job will query.
--      Without these, DELETE WHERE created_at < X does a full table scan.
--   B) Convert the 3 fastest-growing tables to monthly range partitions
--      so old data can be dropped in O(1) instead of O(n).
--
-- Run order: 0010 → 0011 → deploy retention job
-- ============================================================================

-- ── A. RETENTION INDEXES ────────────────────────────────────────────────────
-- One index per table the nightly retention job will hit.
-- All are partial where possible to keep index size small.

-- audit_logs: compliance-grade, keep 365 days
CREATE INDEX IF NOT EXISTS idx_audit_logs_retention
  ON audit_logs (created_at)
  WHERE created_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time
  ON audit_logs (user_id, created_at DESC);

-- system_logs: short-lived operational logs, keep 14 days
CREATE INDEX IF NOT EXISTS idx_system_logs_retention
  ON system_logs (timestamp)
  WHERE timestamp IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_system_logs_level_time
  ON system_logs (level, timestamp DESC);

-- activity_feed: keep 90 days
CREATE INDEX IF NOT EXISTS idx_activity_feed_retention
  ON activity_feed (created_at)
  WHERE created_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_activity_feed_user_time
  ON activity_feed (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_feed_dao_time
  ON activity_feed (dao_id, created_at DESC)
  WHERE dao_id IS NOT NULL;

-- wallet_access_log: security audit, keep 90 days
CREATE INDEX IF NOT EXISTS idx_wallet_access_log_retention
  ON wallet_access_log (created_at);

-- notification_history: keep 30 days
CREATE INDEX IF NOT EXISTS idx_notification_history_retention
  ON notification_history (created_at);

CREATE INDEX IF NOT EXISTS idx_notification_history_user
  ON notification_history (user_id, created_at DESC);

-- notifications: keep 60 days (unread kept until read)
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications (user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_retention
  ON notifications (created_at)
  WHERE read = true;

-- asset_price_history: keep 180 days
CREATE INDEX IF NOT EXISTS idx_asset_price_history_retention
  ON asset_price_history (recorded_at);

CREATE INDEX IF NOT EXISTS idx_asset_price_history_symbol_time
  ON asset_price_history (asset_symbol, recorded_at DESC);

-- execution_metrics: keep 90 days
CREATE INDEX IF NOT EXISTS idx_execution_metrics_retention
  ON execution_metrics (recorded_at);

-- ml_training_data: keep 180 days (model needs history)
CREATE INDEX IF NOT EXISTS idx_ml_training_retention
  ON ml_training_data (recorded_at);

-- platform_metrics: keep 90 days (rollup to daily before delete)
CREATE INDEX IF NOT EXISTS idx_platform_metrics_retention
  ON platform_metrics (timestamp);

-- session_notifications: keep 30 days
CREATE INDEX IF NOT EXISTS idx_session_notifications_retention
  ON session_notifications (created_at);

-- execution_history: keep 180 days
CREATE INDEX IF NOT EXISTS idx_execution_history_retention
  ON execution_history (created_at);

CREATE INDEX IF NOT EXISTS idx_execution_history_user
  ON execution_history (user_id, created_at DESC);

-- ── B. PARTITIONED TABLE: asset_state_snapshots ──────────────────────────────
-- This is your fastest-growing table: 13 pairs × 1-min updates = ~560K rows/month.
-- Partitioning by month lets you DROP a partition instead of running
-- DELETE on 500K rows (which locks, generates WAL, and takes minutes).
--
-- Steps:
--   1. Rename existing table to _legacy
--   2. Create partitioned table
--   3. Attach _legacy as a partition or migrate rows
--   4. Update Drizzle schema to match

DO $$
BEGIN
  -- Only run if table is NOT already partitioned
  IF NOT EXISTS (
    SELECT 1 FROM pg_partitioned_table pt
    JOIN pg_class pc ON pt.partrelid = pc.oid
    WHERE pc.relname = 'asset_state_snapshots'
  ) THEN
    -- Rename existing non-partitioned table
    ALTER TABLE IF EXISTS asset_state_snapshots
      RENAME TO asset_state_snapshots_legacy;

    -- Create partitioned parent
    CREATE TABLE asset_state_snapshots (
      id             UUID NOT NULL DEFAULT gen_random_uuid(),
      asset_node_id  VARCHAR(255) NOT NULL,
      symbol         VARCHAR(20) NOT NULL,
      timestamp      TIMESTAMP NOT NULL DEFAULT NOW(),
      price_usd      DECIMAL(18,8),
      price_confidence INTEGER,
      price_sources  JSONB DEFAULT '[]',
      chain_specific_prices JSONB DEFAULT '{}',
      technical_rsi14 DECIMAL(5,2),
      technical_macd_value DECIMAL(18,8),
      technical_macd_signal DECIMAL(18,8),
      technical_macd_histogram DECIMAL(18,8),
      technical_trend VARCHAR(30),
      technical_momentum INTEGER,
      technical_signals JSONB DEFAULT '{}',
      yield_data     JSONB DEFAULT '{}',
      yield_estimate_30d DECIMAL(18,8),
      yield_estimate_1y  DECIMAL(18,8),
      risk_smart_contract_score INTEGER,
      risk_oracle_score INTEGER,
      risk_governance_score INTEGER,
      risk_liquidation_risk INTEGER,
      risk_overall_score INTEGER,
      risk_weighted_by_dao_type JSONB DEFAULT '{}',
      liquidity_depth_1pct DECIMAL(18,2),
      liquidity_depth_5pct DECIMAL(18,2),
      liquidity_by_chain JSONB DEFAULT '{}',
      graph_version  INTEGER NOT NULL DEFAULT 0,
      correlation_version INTEGER NOT NULL DEFAULT 0,
      shard_update_status JSONB DEFAULT '{}',
      is_stale       BOOLEAN DEFAULT FALSE,
      completeness   INTEGER,
      created_at     TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (id, timestamp)
    ) PARTITION BY RANGE (timestamp);

    -- Create first 6 monthly partitions (current + 5 future)
    CREATE TABLE IF NOT EXISTS asset_state_snapshots_2026_06
      PARTITION OF asset_state_snapshots
      FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

    CREATE TABLE IF NOT EXISTS asset_state_snapshots_2026_07
      PARTITION OF asset_state_snapshots
      FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

    CREATE TABLE IF NOT EXISTS asset_state_snapshots_2026_08
      PARTITION OF asset_state_snapshots
      FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

    CREATE TABLE IF NOT EXISTS asset_state_snapshots_2026_09
      PARTITION OF asset_state_snapshots
      FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

    CREATE TABLE IF NOT EXISTS asset_state_snapshots_2026_10
      PARTITION OF asset_state_snapshots
      FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

    CREATE TABLE IF NOT EXISTS asset_state_snapshots_2026_11
      PARTITION OF asset_state_snapshots
      FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

    -- Migrate legacy rows
    INSERT INTO asset_state_snapshots
    SELECT * FROM asset_state_snapshots_legacy;

    DROP TABLE asset_state_snapshots_legacy;

    RAISE NOTICE 'asset_state_snapshots partitioned successfully';
  ELSE
    RAISE NOTICE 'asset_state_snapshots already partitioned, skipping';
  END IF;
END $$;

-- Indexes on partitioned table (Postgres propagates to all child partitions)
CREATE INDEX IF NOT EXISTS idx_ass_symbol_time
  ON asset_state_snapshots (symbol, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_ass_asset_node_time
  ON asset_state_snapshots (asset_node_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_ass_graph_version
  ON asset_state_snapshots (graph_version);


-- ── C. PARTITIONED TABLE: audit_logs ─────────────────────────────────────────
-- Every API request writes here. At 100 req/min = 4.3M rows/month.
-- Compliance requires 12-month retention. Partitioning lets you drop month-1
-- the day month-13 starts. Without this, deleting 4M rows takes ~10 minutes
-- with full table lock in some Postgres configs.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_partitioned_table pt
    JOIN pg_class pc ON pt.partrelid = pc.oid
    WHERE pc.relname = 'audit_logs'
  ) THEN
    ALTER TABLE IF EXISTS audit_logs RENAME TO audit_logs_legacy;

    CREATE TABLE audit_logs (
      id             UUID NOT NULL DEFAULT gen_random_uuid(),
      timestamp      TIMESTAMP NOT NULL DEFAULT NOW(),
      user_id        VARCHAR REFERENCES users(id),
      user_email     VARCHAR,
      action         VARCHAR NOT NULL,
      resource       VARCHAR NOT NULL,
      resource_id    VARCHAR,
      method         VARCHAR NOT NULL,
      endpoint       VARCHAR NOT NULL,
      ip_address     VARCHAR NOT NULL,
      user_agent     VARCHAR NOT NULL,
      status         INTEGER NOT NULL,
      details        JSONB,
      severity       VARCHAR DEFAULT 'low' NOT NULL,
      category       VARCHAR DEFAULT 'security' NOT NULL,
      created_at     TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (id, timestamp)
    ) PARTITION BY RANGE (timestamp);

    -- 13 months of partitions (compliance buffer)
    CREATE TABLE IF NOT EXISTS audit_logs_2026_06
      PARTITION OF audit_logs FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
    CREATE TABLE IF NOT EXISTS audit_logs_2026_07
      PARTITION OF audit_logs FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
    CREATE TABLE IF NOT EXISTS audit_logs_2026_08
      PARTITION OF audit_logs FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
    CREATE TABLE IF NOT EXISTS audit_logs_2026_09
      PARTITION OF audit_logs FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
    CREATE TABLE IF NOT EXISTS audit_logs_2026_10
      PARTITION OF audit_logs FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');
    CREATE TABLE IF NOT EXISTS audit_logs_2026_11
      PARTITION OF audit_logs FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');
    CREATE TABLE IF NOT EXISTS audit_logs_2026_12
      PARTITION OF audit_logs FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');
    CREATE TABLE IF NOT EXISTS audit_logs_2027_01
      PARTITION OF audit_logs FOR VALUES FROM ('2027-01-01') TO ('2027-02-01');

    INSERT INTO audit_logs SELECT * FROM audit_logs_legacy;
    DROP TABLE audit_logs_legacy;

    RAISE NOTICE 'audit_logs partitioned successfully';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time_p
  ON audit_logs (user_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_severity
  ON audit_logs (severity, timestamp DESC);


-- ── D. FAST PATH: system_logs ────────────────────────────────────────────────
-- 7-day retention means we never accumulate more than 1 week × write rate.
-- At high volume this is still millions of rows. Partition by week.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_partitioned_table pt
    JOIN pg_class pc ON pt.partrelid = pc.oid
    WHERE pc.relname = 'system_logs'
  ) THEN
    ALTER TABLE IF EXISTS system_logs RENAME TO system_logs_legacy;

    CREATE TABLE system_logs (
      id        UUID NOT NULL DEFAULT gen_random_uuid(),
      level     VARCHAR DEFAULT 'info' NOT NULL,
      message   TEXT NOT NULL,
      service   VARCHAR DEFAULT 'api' NOT NULL,
      metadata  JSONB,
      timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
      PRIMARY KEY (id, timestamp)
    ) PARTITION BY RANGE (timestamp);

    -- 4 weekly partitions (only ever need last 14 days live)
    CREATE TABLE IF NOT EXISTS system_logs_w1
      PARTITION OF system_logs
      FOR VALUES FROM (NOW() - INTERVAL '14 days') TO (NOW() - INTERVAL '7 days');

    CREATE TABLE IF NOT EXISTS system_logs_w2
      PARTITION OF system_logs
      FOR VALUES FROM (NOW() - INTERVAL '7 days')  TO (NOW());

    CREATE TABLE IF NOT EXISTS system_logs_w3
      PARTITION OF system_logs
      FOR VALUES FROM (NOW()) TO (NOW() + INTERVAL '7 days');

    CREATE TABLE IF NOT EXISTS system_logs_w4
      PARTITION OF system_logs
      FOR VALUES FROM (NOW() + INTERVAL '7 days') TO (NOW() + INTERVAL '14 days');

    INSERT INTO system_logs SELECT * FROM system_logs_legacy
      WHERE timestamp > NOW() - INTERVAL '14 days';

    DROP TABLE system_logs_legacy;

    RAISE NOTICE 'system_logs partitioned successfully';
  END IF;
END $$;


-- ── E. METRICS AGGREGATION TABLE ─────────────────────────────────────────────
-- Before we delete old rows from platform_metrics / dao_analytics / revenue_metrics,
-- we want daily rollups so we don't lose the trend data.
-- This table is tiny — one row per metric per day.

CREATE TABLE IF NOT EXISTS metrics_daily_rollup (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name  VARCHAR(100) NOT NULL,
  entity_id    UUID,                          -- daoId, userId, etc. (nullable = global)
  date         DATE NOT NULL,
  value        NUMERIC(20, 8) NOT NULL,
  dimensions   JSONB DEFAULT '{}',            -- { "chain": "celo", "type": "dao" } etc.
  created_at   TIMESTAMP DEFAULT NOW(),
  UNIQUE (metric_name, entity_id, date)
);

CREATE INDEX IF NOT EXISTS idx_rollup_metric_date
  ON metrics_daily_rollup (metric_name, date DESC);

CREATE INDEX IF NOT EXISTS idx_rollup_entity
  ON metrics_daily_rollup (entity_id, date DESC)
  WHERE entity_id IS NOT NULL;


-- ── F. PARTITION MANAGEMENT HELPER ───────────────────────────────────────────
-- This function creates the next month's partition for a given table.
-- Call it from your monthly cron job.

CREATE OR REPLACE FUNCTION create_next_month_partition(
  parent_table TEXT,
  target_month DATE DEFAULT DATE_TRUNC('month', NOW() + INTERVAL '1 month')
)
RETURNS VOID AS $$
DECLARE
  partition_name TEXT;
  start_date     DATE;
  end_date       DATE;
BEGIN
  start_date     := DATE_TRUNC('month', target_month);
  end_date       := start_date + INTERVAL '1 month';
  partition_name := parent_table || '_' ||
                    TO_CHAR(start_date, 'YYYY_MM');

  IF NOT EXISTS (
    SELECT 1 FROM pg_class WHERE relname = partition_name
  ) THEN
    EXECUTE FORMAT(
      'CREATE TABLE %I PARTITION OF %I FOR VALUES FROM (%L) TO (%L)',
      partition_name, parent_table, start_date, end_date
    );
    RAISE NOTICE 'Created partition %', partition_name;
  ELSE
    RAISE NOTICE 'Partition % already exists', partition_name;
  END IF;
END;
$$ LANGUAGE plpgsql;


-- Drop old partitions (called by retention job after archiving)
CREATE OR REPLACE FUNCTION drop_old_partition(
  parent_table   TEXT,
  months_to_keep INTEGER DEFAULT 3
)
RETURNS VOID AS $$
DECLARE
  cutoff_month    TEXT;
  partition_name  TEXT;
BEGIN
  cutoff_month   := TO_CHAR(
    DATE_TRUNC('month', NOW() - (months_to_keep || ' months')::INTERVAL),
    'YYYY_MM'
  );
  partition_name := parent_table || '_' || cutoff_month;

  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = partition_name) THEN
    EXECUTE FORMAT('DROP TABLE %I', partition_name);
    RAISE NOTICE 'Dropped partition %', partition_name;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================