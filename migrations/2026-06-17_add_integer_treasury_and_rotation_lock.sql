-- Migration: add integer treasury storage and rotation processing lock
-- Adds a new column `treasury_balance_units` (numeric, scale 0) for storing integer smallest-unit balances
-- Adds a `rotation_processing` boolean flag to the `daos` table for DB-backed locking

BEGIN;

-- Add new integer balance column if not exists
ALTER TABLE IF EXISTS daos
  ADD COLUMN IF NOT EXISTS treasury_balance_units numeric(38,0) DEFAULT 0;

-- Add rotation processing flag
ALTER TABLE IF EXISTS daos
  ADD COLUMN IF NOT EXISTS rotation_processing boolean DEFAULT false;

-- NOTE: automatic population attempted by multiplying existing decimal value.
-- If your existing `treasury_balance` column is in major units with 2 decimals (e.g., dollars),
-- this populates `treasury_balance_units` as cents. Adjust multiplier to match your smallest unit.
-- This operation may be destructive for large datasets; review before executing in production.
UPDATE daos
SET treasury_balance_units = ROUND(treasury_balance * 100)::numeric
WHERE treasury_balance_units = 0;

COMMIT;

-- Important: Review the multiplier above. If your system uses a different smallest-unit (e.g., 1e18 wei),
-- run a manual migration converting values appropriately, or set `treasury_balance_units` explicitly.
