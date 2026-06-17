-- Migration: 2026-06-16 (CONCURRENTLY index creation)
-- Run these statements OUTSIDE a transaction (psql -c or your migration runner's non-transactional mode).
-- Verify duplicates with the pre-check script before running.

-- Create unique index for stable_asset_registry (chain + token)
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS stable_asset_registry_chain_token_unique_key
  ON stable_asset_registry (chain_id, token_address);

-- Create unique idempotency index for stable_inflow_events
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS stable_inflow_events_idempotency_unique_key
  ON stable_inflow_events (chain_id, tx_hash, log_index, token_address, to_address);

-- Create unique idempotency index for stable_outflow_events
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS stable_outflow_events_idempotency_unique_key
  ON stable_outflow_events (chain_id, tx_hash, log_index, token_address, from_address);

-- Notes:
-- 1) If your migration runner wraps everything in a transaction, extract and run
--    these three lines manually using psql so they execute outside a transaction.
-- 2) If any CREATE fails due to duplicates, resolve duplicates first (see pre-check file).
