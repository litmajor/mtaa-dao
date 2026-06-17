-- Migration: add on-chain mint tracking columns to user_achievements
-- Adds: token_id, mint_pending, mint_tx_hash, minted_at

BEGIN;

ALTER TABLE IF EXISTS user_achievements
  ADD COLUMN IF NOT EXISTS token_id VARCHAR;

ALTER TABLE IF EXISTS user_achievements
  ADD COLUMN IF NOT EXISTS mint_pending BOOLEAN DEFAULT false;

ALTER TABLE IF EXISTS user_achievements
  ADD COLUMN IF NOT EXISTS mint_tx_hash VARCHAR;

ALTER TABLE IF EXISTS user_achievements
  ADD COLUMN IF NOT EXISTS minted_at TIMESTAMPTZ;

-- Ensure no NULLs for mint_pending
UPDATE user_achievements SET mint_pending = false WHERE mint_pending IS NULL;

COMMIT;
