-- ════════════════════════════════════════════════════════════════════════════════
-- Migration: Add Withdrawal Approvals and Multisig Tracking
-- Phase 4B: Vault Withdrawal System with Multisig for DAO Treasuries
-- ════════════════════════════════════════════════════════════════════════════════

-- 1. Create withdrawal_approvals table for tracking multisig approvals
CREATE TABLE IF NOT EXISTS withdrawal_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Request identification
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  dao_id UUID REFERENCES daos(id) ON DELETE CASCADE,
  user_id VARCHAR REFERENCES users(id) ON DELETE SET NULL,
  
  -- Withdrawal details
  amount DECIMAL(18, 8) NOT NULL,
  destination VARCHAR(255) NOT NULL,
  
  -- Multisig tracking
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, approved, rejected, executed, expired
  required_signatures INTEGER NOT NULL DEFAULT 2,
  current_signatures INTEGER NOT NULL DEFAULT 0,
  
  -- Approval signers
  signers JSONB DEFAULT '[]'::jsonb, -- array of {user_id, signature, signed_at, role}
  
  -- Timeline
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMP,
  executed_at TIMESTAMP,
  executed_by VARCHAR REFERENCES users(id),
  rejection_reason TEXT,
  
  -- Audit
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Indexes
  CHECK (amount > 0),
  CHECK (current_signatures <= required_signatures)
);

CREATE INDEX idx_withdrawal_approvals_vault_id ON withdrawal_approvals(vault_id);
CREATE INDEX idx_withdrawal_approvals_dao_id ON withdrawal_approvals(dao_id);
CREATE INDEX idx_withdrawal_approvals_status ON withdrawal_approvals(status);
CREATE INDEX idx_withdrawal_approvals_user_id ON withdrawal_approvals(user_id);
CREATE INDEX idx_withdrawal_approvals_created_at ON withdrawal_approvals(created_at);

-- 2. Add withdrawal tracking columns to vault_transactions table
-- (assumes vault_transactions table already exists)
ALTER TABLE vault_transactions 
  ADD COLUMN IF NOT EXISTS approval_id UUID REFERENCES withdrawal_approvals(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requires_multisig BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS destination_address VARCHAR(255);

-- 3. Create multisig_signatures table for detailed signature tracking
CREATE TABLE IF NOT EXISTS multisig_signatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Reference to approval request
  approval_id UUID NOT NULL REFERENCES withdrawal_approvals(id) ON DELETE CASCADE,
  
  -- Signer information
  signer_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  signer_role VARCHAR(50) NOT NULL, -- admin, elder, member
  
  -- Signature details
  signature VARCHAR(255),
  signed_at TIMESTAMP NOT NULL DEFAULT NOW(),
  ip_address VARCHAR(45),
  
  -- Verification
  is_valid BOOLEAN DEFAULT true,
  verification_error TEXT,
  
  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_multisig_signatures_approval_id ON multisig_signatures(approval_id);
CREATE INDEX idx_multisig_signatures_signer_id ON multisig_signatures(signer_id);
CREATE INDEX idx_multisig_signatures_signed_at ON multisig_signatures(signed_at);

-- 4. Add daily withdrawal limits tracking for vaults
CREATE TABLE IF NOT EXISTS vault_withdrawal_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Vault reference
  vault_id UUID NOT NULL REFERENCES vaults(id) ON DELETE CASCADE,
  
  -- Daily tracking
  date DATE NOT NULL,
  daily_total_withdrawn DECIMAL(18, 8) NOT NULL DEFAULT 0,
  withdrawal_count INTEGER NOT NULL DEFAULT 0,
  
  -- Metadata
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Make date+vault unique
  UNIQUE(vault_id, date)
);

CREATE INDEX idx_vault_withdrawal_tracking_vault_id ON vault_withdrawal_tracking(vault_id);
CREATE INDEX idx_vault_withdrawal_tracking_date ON vault_withdrawal_tracking(date);

-- ════════════════════════════════════════════════════════════════════════════════
-- AUDIT VIEWS
-- ════════════════════════════════════════════════════════════════════════════════

-- View: Pending withdrawal approvals needing signatures
-- SELECT * FROM withdrawal_approvals WHERE status = 'pending' AND current_signatures < required_signatures;

-- View: Failed to complete multisig timeouts
-- SELECT * FROM withdrawal_approvals WHERE status = 'pending' AND NOW() > expires_at;

-- View: Daily withdrawal summary per DAO
-- SELECT 
--   wa.dao_id, 
--   DATE(wa.created_at) as date,
--   COUNT(*) as withdrawal_requests,
--   SUM(CAST(wa.amount AS NUMERIC)) as total_withdrawn,
--   SUM(CASE WHEN wa.status = 'executed' THEN 1 ELSE 0 END) as executed_count
-- FROM withdrawal_approvals wa
-- WHERE wa.status IN ('executed', 'pending', 'approved')
-- GROUP BY wa.dao_id, DATE(wa.created_at);

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION QUERIES
-- ════════════════════════════════════════════════════════════════════════════════

-- Check all tables created successfully
-- SELECT table_name FROM information_schema.tables 
-- WHERE table_name IN ('withdrawal_approvals', 'multisig_signatures', 'vault_withdrawal_tracking')
-- AND table_schema = 'public';

-- Check indexes created
-- SELECT indexname FROM pg_indexes 
-- WHERE tablename IN ('withdrawal_approvals', 'multisig_signatures', 'vault_withdrawal_tracking');
