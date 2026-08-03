-- Migration: Fix cross_chain_transfers decimal precision for token amounts
-- Run: node scripts/apply_sql_migration.js migrations/20260721_fix_cross_chain_transfers_decimal_precision.sql
-- Reason: decimal(36,18) overflows on token amounts >= 1 token at 18 decimals
--         (36 total digits - 18 reserved for decimals = 18 integer digits max, but 10^18 requires 19 digits)
--         Increased to decimal(38,18) to safely hold amounts up to ~10^20 (realistic for any token supply)

BEGIN;

-- Increase precision of sourceAmount and targetAmount to accommodate token amounts up to 1 sextillion
-- This is essential for any realistic swap involving tokens with 18 decimal places
ALTER TABLE cross_chain_transfers
  ALTER COLUMN source_amount TYPE decimal(38, 18),
  ALTER COLUMN target_amount TYPE decimal(38, 18);

-- Verify the columns were updated
-- SELECT column_name, numeric_precision, numeric_scale 
-- FROM information_schema.columns 
-- WHERE table_name = 'cross_chain_transfers' 
--   AND column_name IN ('source_amount', 'target_amount');

COMMIT;
