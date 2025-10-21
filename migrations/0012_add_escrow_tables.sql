
-- Escrow accounts table
CREATE TABLE IF NOT EXISTS escrow_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES tasks(id),
  payer_id VARCHAR REFERENCES users(id) NOT NULL,
  payee_id VARCHAR REFERENCES users(id) NOT NULL,
  amount DECIMAL(18, 8) NOT NULL,
  currency VARCHAR NOT NULL DEFAULT 'cUSD',
  status VARCHAR NOT NULL DEFAULT 'pending',
  milestones JSONB DEFAULT '[]',
  current_milestone VARCHAR DEFAULT '0',
  funded_at TIMESTAMP,
  released_at TIMESTAMP,
  refunded_at TIMESTAMP,
  dispute_reason TEXT,
  disputed_at TIMESTAMP,
  resolved_at TIMESTAMP,
  transaction_hash VARCHAR,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Escrow milestones table
CREATE TABLE IF NOT EXISTS escrow_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id UUID REFERENCES escrow_accounts(id) NOT NULL,
  milestone_number VARCHAR NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(18, 8) NOT NULL,
  status VARCHAR NOT NULL DEFAULT 'pending',
  approved_by VARCHAR REFERENCES users(id),
  approved_at TIMESTAMP,
  released_at TIMESTAMP,
  proof_url TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Escrow disputes table
CREATE TABLE IF NOT EXISTS escrow_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  escrow_id UUID REFERENCES escrow_accounts(id) NOT NULL,
  raised_by VARCHAR REFERENCES users(id) NOT NULL,
  reason TEXT NOT NULL,
  evidence JSONB DEFAULT '[]',
  status VARCHAR NOT NULL DEFAULT 'open',
  resolution TEXT,
  resolved_by VARCHAR REFERENCES users(id),
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_escrow_accounts_payer ON escrow_accounts(payer_id);
CREATE INDEX IF NOT EXISTS idx_escrow_accounts_payee ON escrow_accounts(payee_id);
CREATE INDEX IF NOT EXISTS idx_escrow_accounts_status ON escrow_accounts(status);
CREATE INDEX IF NOT EXISTS idx_escrow_milestones_escrow ON escrow_milestones(escrow_id);
CREATE INDEX IF NOT EXISTS idx_escrow_disputes_escrow ON escrow_disputes(escrow_id);
