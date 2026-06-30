-- Migration: Add treasury_balance_units to daos
-- Date: 2026-06-19
-- Purpose: Add smallest-unit integer field for DAO treasury balances (e.g., wei/cents)

BEGIN;

ALTER TABLE daos
  ADD COLUMN IF NOT EXISTS treasury_balance_units NUMERIC(38,0) DEFAULT 0;

-- Initialize existing rows to 0 (if any NULLs)
UPDATE daos SET treasury_balance_units = 0 WHERE treasury_balance_units IS NULL;

COMMIT;
