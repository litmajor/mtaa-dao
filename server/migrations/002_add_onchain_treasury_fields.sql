-- Migration: Add on-chain execution tracking fields to multisig and treasury tables
-- Date: 2026-03-16
-- Description: Adds deployment tracking to multisigWallets and on-chain execution
--              proof fields to treasuryMultisigTransactions for Gnosis Safe integration

-- ============================================================================
-- 1. Add chain field to multisigWallets (for blockchain network identification)
-- ============================================================================
ALTER TABLE multisig_wallets 
ADD COLUMN IF NOT EXISTS chain VARCHAR(50) NOT NULL DEFAULT 'ethereum'
ADD COLUMN IF NOT EXISTS deployed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS deployment_tx_hash VARCHAR(255);

-- Create index for faster lookups by chain
CREATE INDEX IF NOT EXISTS multisig_wallets_chain_idx ON multisig_wallets(chain);

-- ============================================================================
-- 2. Add on-chain execution fields to treasuryMultisigTransactions
-- ============================================================================
ALTER TABLE treasury_multisig_transactions
ADD COLUMN IF NOT EXISTS multisig_wallet_id UUID REFERENCES multisig_wallets(id),
ADD COLUMN IF NOT EXISTS contract_function VARCHAR(255),
ADD COLUMN IF NOT EXISTS params JSONB,
ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS submitted_tx_hash VARCHAR(255);

-- Add index for tracking submitted transactions
CREATE INDEX IF NOT EXISTS treasury_multisig_submitted_tx_idx 
  ON treasury_multisig_transactions(submitted_tx_hash) 
  WHERE submitted_tx_hash IS NOT NULL;

-- Add index for querying by multisig wallet
CREATE INDEX IF NOT EXISTS treasury_multisig_wallet_idx 
  ON treasury_multisig_transactions(multisig_wallet_id);

-- ============================================================================
-- 3. Update status values to support new workflow
-- ============================================================================
-- Add CHECK constraint for valid status values (if using enum-like pattern)
-- Note: PostgreSQL allows any value in VARCHAR, but we can document the expected values:
-- pending, signed, submitted, executed, rejected, expired

-- ============================================================================
-- 4. Add tracking table for reconciliation audits
-- ============================================================================
CREATE TABLE IF NOT EXISTS treasury_reconciliation_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  audit_timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
  expected_balance DECIMAL(25, 8) NOT NULL,
  actual_on_chain_balance DECIMAL(25, 8) NOT NULL,
  treasury_positions_sum DECIMAL(25, 8) NOT NULL,
  stable_inflow_sum DECIMAL(25, 8) NOT NULL,
  withdrawals_sum DECIMAL(25, 8) NOT NULL DEFAULT 0,
  discrepancy DECIMAL(25, 8) NOT NULL,
  is_reconciled BOOLEAN DEFAULT FALSE,
  reconciliation_tx_hash VARCHAR(255),
  reconciliation_notes TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS treasury_reconciliation_dao_idx 
  ON treasury_reconciliation_audits(dao_id, audit_timestamp DESC);

CREATE INDEX IF NOT EXISTS treasury_reconciliation_unresolved_idx 
  ON treasury_reconciliation_audits(is_reconciled, dao_id)
  WHERE is_reconciled = FALSE;

-- ============================================================================
-- 5. Create materialized view for vault balance computations
-- ============================================================================
-- This view computes vault balances from vaultTokenHoldings (chain-indexed, source of truth)
CREATE OR REPLACE VIEW vault_computed_balances AS
SELECT 
  v.id,
  v.dao_id,
  v.user_id,
  COALESCE(SUM(vth.balance), 0::DECIMAL) AS computed_balance,
  MAX(vth.last_indexed_at) AS last_indexed_at,
  COUNT(DISTINCT vth.id) AS token_holdings_count
FROM vaults v
LEFT JOIN vault_token_holdings vth ON v.id = vth.vault_id
GROUP BY v.id, v.dao_id, v.user_id;

-- ============================================================================
-- 6. Create materialized view for DAO treasury balance computations
-- ============================================================================
-- This view computes treasury balances from treasuryPositions + stableInflowEvents (chain-indexed)
CREATE OR REPLACE VIEW dao_computed_treasuries AS
SELECT 
  d.id AS dao_id,
  COALESCE(SUM(tp.balance), 0::DECIMAL) AS treasury_positions_sum,
  COALESCE(SUM(sie.amount), 0::DECIMAL) AS stable_inflow_sum,
  COALESCE(SUM(tp.balance), 0::DECIMAL) + COALESCE(SUM(sie.amount), 0::DECIMAL) AS computed_total_balance,
  MAX(tp.last_indexed_at) AS last_treasury_indexed_at,
  MAX(sie.created_at) AS last_inflow_at,
  COUNT(DISTINCT tp.id) AS treasury_positions_count,
  COUNT(DISTINCT sie.id) AS stable_inflow_count
FROM daos d
LEFT JOIN treasury_positions tp ON d.id = tp.dao_id
LEFT JOIN stable_inflow_events sie ON d.id = sie.dao_id
GROUP BY d.id;

-- ============================================================================
-- 7. Create audit log table for multisig submissionTracking
-- ============================================================================
CREATE TABLE IF NOT EXISTS multisig_submission_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES treasury_multisig_transactions(id) ON DELETE CASCADE,
  submitted_at TIMESTAMP NOT NULL DEFAULT NOW(),
  submitted_tx_hash VARCHAR(255) NOT NULL,
  chain VARCHAR(50) NOT NULL,
  submission_status VARCHAR(50) NOT NULL, -- submitted, pending, confirmed, failed
  confirmation_blocks INTEGER DEFAULT 0,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS multisig_submission_tx_hash_idx 
  ON multisig_submission_log(submitted_tx_hash);

CREATE INDEX IF NOT EXISTS multisig_submission_status_idx 
  ON multisig_submission_log(submission_status, submitted_at DESC);

-- ============================================================================
-- 8. Backwards compatibility: Deprecated columns note
-- ============================================================================
-- The following fields are now deprecated and should not be updated directly:
-- - daos.treasury_balance (use dao_computed_treasuries view instead)
-- - vaults.balance (use vault_computed_balances view instead)
-- - treasury_multisig_transactions.execution_tx_hash (use submitted_tx_hash instead)
--
-- These fields are kept for backward compatibility but will drift from on-chain state.
-- All new code should use computed views and on-chain event indexing.

-- ============================================================================
-- 9. Sample Query Documentation
-- ============================================================================
/*
-- Get current DAO treasury balance (chain-indexed):
SELECT dto.dao_id, dto.computed_total_balance, dto.last_treasury_indexed_at
FROM dao_computed_treasuries dto
WHERE dto.dao_id = $1;

-- Get current vault balance (chain-indexed):
SELECT vcb.id, vcb.computed_balance, vcb.last_indexed_at
FROM vault_computed_balances vcb
WHERE vcb.id = $1;

-- Check for treasury discrepancies (quarterly reconciliation):
SELECT * FROM treasury_reconciliation_audits
WHERE is_reconciled = FALSE AND dao_id = $1
ORDER BY audit_timestamp DESC
LIMIT 10;

-- Get pending multisig submissions (not yet on chain):
SELECT tmt.id, tmt.transaction_type, tmt.status, msl.submission_status
FROM treasury_multisig_transactions tmt
LEFT JOIN multisig_submission_log msl ON tmt.id = msl.transaction_id
WHERE tmt.status = 'submitted' AND msl.submission_status NOT IN ('confirmed')
ORDER BY msl.submitted_at DESC;
*/
