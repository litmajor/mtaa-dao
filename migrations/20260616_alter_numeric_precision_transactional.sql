-- Migration: 2026-06-16 (Transactional precision ALTERs + verification)
-- Safe to run inside a transaction. Run after the CONCURRENTLY index creation (or in a separate step).

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

-- Verification
SELECT column_name, data_type, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_name IN ('stable_inflow_events', 'stable_outflow_events')
  AND column_name IN ('raw_amount', 'stable_units_microusd');

-- Rollback hints:
-- ALTER TABLE <table> ALTER COLUMN <col> TYPE previous_type USING <col>::previous_type;
