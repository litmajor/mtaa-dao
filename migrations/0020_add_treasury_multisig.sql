
-- Migration: Add Treasury Multi-Sig and Audit System

-- Add treasury security columns to DAOs
ALTER TABLE daos 
ADD COLUMN IF NOT EXISTS treasury_multisig_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS treasury_required_signatures INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS treasury_signers JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS treasury_withdrawal_threshold DECIMAL(18,2) DEFAULT 1000.00,
ADD COLUMN IF NOT EXISTS treasury_daily_limit DECIMAL(18,2) DEFAULT 10000.00,
ADD COLUMN IF NOT EXISTS treasury_monthly_budget DECIMAL(18,2);

-- Multi-Sig Transactions Table
CREATE TABLE IF NOT EXISTS treasury_multisig_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  proposed_by VARCHAR NOT NULL REFERENCES users(id),
  transaction_type VARCHAR NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  currency VARCHAR DEFAULT 'cUSD',
  recipient VARCHAR,
  purpose TEXT NOT NULL,
  required_signatures INTEGER NOT NULL,
  current_signatures INTEGER DEFAULT 0,
  signers JSONB DEFAULT '[]'::jsonb,
  status VARCHAR DEFAULT 'pending',
  approved_at TIMESTAMP,
  executed_at TIMESTAMP,
  execution_tx_hash VARCHAR,
  expires_at TIMESTAMP NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Budget Allocations Table
CREATE TABLE IF NOT EXISTS treasury_budget_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  category VARCHAR NOT NULL,
  allocated_amount DECIMAL(18,2) NOT NULL,
  spent_amount DECIMAL(18,2) DEFAULT 0,
  remaining_amount DECIMAL(18,2) NOT NULL,
  period VARCHAR NOT NULL,
  period_start TIMESTAMP NOT NULL,
  period_end TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by VARCHAR NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Audit Log Table
CREATE TABLE IF NOT EXISTS treasury_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dao_id UUID NOT NULL REFERENCES daos(id) ON DELETE CASCADE,
  actor_id VARCHAR NOT NULL REFERENCES users(id),
  action VARCHAR NOT NULL,
  amount DECIMAL(18,2),
  previous_balance DECIMAL(18,2),
  new_balance DECIMAL(18,2),
  category VARCHAR,
  reason TEXT NOT NULL,
  multisig_tx_id UUID REFERENCES treasury_multisig_transactions(id),
  transaction_hash VARCHAR,
  ip_address VARCHAR,
  metadata JSONB,
  severity VARCHAR DEFAULT 'medium',
  timestamp TIMESTAMP DEFAULT NOW() NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_multisig_dao_status ON treasury_multisig_transactions(dao_id, status);
CREATE INDEX IF NOT EXISTS idx_budget_dao_active ON treasury_budget_allocations(dao_id, is_active);
CREATE INDEX IF NOT EXISTS idx_audit_dao_timestamp ON treasury_audit_log(dao_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_severity ON treasury_audit_log(severity, timestamp DESC);

-- Update existing DAOs to have elder members as default signers
UPDATE daos 
SET treasury_signers = (
  SELECT jsonb_agg(user_id)
  FROM dao_memberships
  WHERE dao_memberships.dao_id = daos.id
    AND dao_memberships.role IN ('elder', 'admin')
    AND dao_memberships.status = 'approved'
)
WHERE treasury_signers = '[]'::jsonb;

COMMENT ON TABLE treasury_multisig_transactions IS 'Multi-signature treasury transactions requiring elder approval';
COMMENT ON TABLE treasury_budget_allocations IS 'Budget allocations by category with spending tracking';
COMMENT ON TABLE treasury_audit_log IS 'Comprehensive audit trail for all treasury operations';
