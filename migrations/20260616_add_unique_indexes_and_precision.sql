-- Migration: 2026-06-16
-- Purpose: add UNIQUE indexes required for ON CONFLICT upserts and
-- enforce numeric precision for high-precision token amounts.
-- IMPORTANT NOTES:
-- 1) `CREATE INDEX CONCURRENTLY` cannot run inside a transaction block.
--    Run the `CONCURRENTLY` statements alone (psql -c or a migration runner that
--    executes them outside a transaction).
-- 2) Verify duplicates BEFORE creating unique indexes. If duplicates exist,
--    resolve them (dedupe or archive) before proceeding.
-- 3) ALTER TYPE (changing numeric precision) may lock the table. Run during low traffic.

------------------------------------------------------------
-- Step 0: Pre-check for duplicates (run and inspect results)
------------------------------------------------------------
-- Check stable_asset_registry duplicates (chain_id + token_address)
SELECT chain_id, token_address, count(*) AS cnt
FROM stable_asset_registry
GROUP BY chain_id, token_address
HAVING count(*) > 1;

-- Check stable_inflow_events duplicates
SELECT chain_id, tx_hash, log_index, token_address, to_address, count(*) AS cnt
FROM stable_inflow_events
GROUP BY chain_id, tx_hash, log_index, token_address, to_address
HAVING count(*) > 1;

-- Check stable_outflow_events duplicates
SELECT chain_id, tx_hash, log_index, token_address, from_address, count(*) AS cnt
FROM stable_outflow_events
GROUP BY chain_id, tx_hash, log_index, token_address, from_address
HAVING count(*) > 1;

-- If any of the above return rows, resolve duplicates before continuing.

------------------------------------------------------------
-- Step 1: Create UNIQUE indexes (non-transactional, run separately)
-- Run these commands separately (one-by-one) using psql or a migration tool
-- that supports non-transactional statements. Example:
-- psql -d $DATABASE -c "CREATE UNIQUE INDEX CONCURRENTLY ..."
------------------------------------------------------------
-- Create unique index for stable_asset_registry (chain + token)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS stable_asset_registry_chain_token_unique_key
  ON stable_asset_registry (chain_id, token_address);

-- Create unique idempotency index for stable_inflow_events
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS stable_inflow_events_idempotency_unique_key
  ON stable_inflow_events (chain_id, tx_hash, log_index, token_address, to_address);

-- Create unique idempotency index for stable_outflow_events
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS stable_outflow_events_idempotency_unique_key
  ON stable_outflow_events (chain_id, tx_hash, log_index, token_address, from_address);

-- Note: If your migration runner wraps statements in a transaction, you must
-- extract and run the three CREATE INDEX CONCURRENTLY statements outside that
-- transaction (psql -c or equivalent).

------------------------------------------------------------
-- Step 2: Transactional schema adjustments (safe to run in a transaction)
-- These ALTERs adjust numeric precision for amount fields.
------------------------------------------------------------
BEGIN;

-- Ensure raw_amount in stable_inflow_events uses high precision numeric(78,0)
ALTER TABLE stable_inflow_events
  ALTER COLUMN raw_amount TYPE numeric(78,0) USING raw_amount::numeric;

-- Ensure stable_units_microusd in stable_inflow_events uses numeric(38,0)
ALTER TABLE stable_inflow_events
  ALTER COLUMN stable_units_microusd TYPE numeric(38,0) USING stable_units_microusd::numeric;

-- Ensure raw_amount in stable_outflow_events uses high precision numeric(78,0)
ALTER TABLE stable_outflow_events
  ALTER COLUMN raw_amount TYPE numeric(78,0) USING raw_amount::numeric;

-- Ensure stable_units_microusd in stable_outflow_events uses numeric(38,0)
ALTER TABLE stable_outflow_events
  ALTER COLUMN stable_units_microusd TYPE numeric(38,0) USING stable_units_microusd::numeric;

COMMIT;

------------------------------------------------------------
-- Verification queries
------------------------------------------------------------
-- Confirm indexes exist
SELECT indexname, indexdef FROM pg_indexes WHERE indexname IN (
  'stable_asset_registry_chain_token_unique_key',
  'stable_inflow_events_idempotency_unique_key',
  'stable_outflow_events_idempotency_unique_key'
);

-- Quick sanity checks on column types
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_name IN ('stable_inflow_events', 'stable_outflow_events')
  AND column_name IN ('raw_amount', 'stable_units_microusd');

------------------------------------------------------------
-- Rollback (manual)
-- To rollback the unique index changes, run these (non-transactional):
-- DROP INDEX CONCURRENTLY IF EXISTS stable_inflow_events_idempotency_unique_key;
-- DROP INDEX CONCURRENTLY IF EXISTS stable_outflow_events_idempotency_unique_key;
-- DROP INDEX CONCURRENTLY IF EXISTS stable_asset_registry_chain_token_unique_key;
-- To rollback precision changes you must ALTER COLUMN TYPE back to previous types.
------------------------------------------------------------
